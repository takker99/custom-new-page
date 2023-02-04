// ported from https://scrapbox.io/takker/custom-new-page-3
import {
  disconnect,
  encodeTitleURI,
  makeSocket,
  openInTheSameTab,
  patch,
  Scrapbox,
  sleep,
  Socket,
  useStatusBar,
} from "./deps/scrapbox.ts";
import { getSelection } from "./selection.ts";
import { defaultHook } from "./hook.ts";
import type { NewPageHook, NewPageHookResult, OpenMode } from "./hook.ts";
declare const scrapbox: Scrapbox;
export type {
  NewPageHook,
  NewPageHookOptions,
  NewPageHookResult,
  OpenMode,
  Page,
} from "./hook.ts";

export interface NewPageInit {
  /** 切り出し先project
   *
   * @default 現在のprojectと同じ
   */
  project?: string;
  /** 切り出したページを開く方法
   *
   * @default: "newtab"
   */
  mode?: OpenMode;
  /** 切り出したページなどを作成する関数
   *
   * 最初に`undefined`以外を返したhookだけを採用する
   */
  hooks?: NewPageHook[];
}
export const newPage = async (init?: NewPageInit): Promise<void> => {
  // 設定とか
  const {
    project = scrapbox.Project.name,
    mode = "newtab",
  } = init ?? {};
  const hooks = [...(init?.hooks ?? []), defaultHook];

  // 切り出す範囲とテキストを取得する
  const { selectionRange: { start, end }, selectedText } = getSelection();
  if (!selectedText) return;
  if (scrapbox.Layout !== "page") return;

  // 切り出すページを作る
  let result: NewPageHookResult | undefined;
  for (const hook of hooks) {
    const promise = hook(selectedText, {
      title: scrapbox.Page.title,
      projectFrom: scrapbox.Project.name,
      projectTo: project,
      lines: scrapbox.Page.lines.slice(start.line, end.line + 1),
      mode,
    });
    result = promise instanceof Promise ? await promise : promise;
    if (result) break;
  }
  if (result === undefined) {
    //ここに到達したらおかしい
    throw Error("どの関数でも切り出しできなかった");
  }

  // 個別のpageに切り出す
  let socket: Socket | undefined;
  const { render, dispose } = useStatusBar();
  try {
    const length = result.pages.length;
    render(
      { type: "spinner" },
      { type: "text", text: `Create new ${length} pages...` },
    );
    socket = await makeSocket();
    let counter = 0;
    await Promise.all(result.pages.map(
      async (page) => {
        await patch(page.project, page.title, (lines) => [
          ...lines.map((line) => line.text),
          ...page.lines,
        ], { socket });

        render(
          { type: "spinner" },
          {
            type: "text",
            text: `Create ${length - (++counter)} pages...`,
          },
        );
      },
    ));

    render(
      { type: "spinner" },
      { type: "text", text: "Created. Removing cut text..." },
    );

    // 書き込みに成功したらもとのテキストを消す
    const text = result.text;
    if (selectedText === text) return;
    await patch(scrapbox.Project.name, scrapbox.Page.title, (lines) => {
      const lines_ = lines.map((line) => line.text);
      return [
        ...lines_.slice(0, start.line),
        ...`${lines_[start.line].slice(0, start.char)}${text}${
          // end.charが行末+1まであった場合は、end.lineの直後の改行まで取り除かれる
          lines_.slice(end.line).join("\n").slice(end.char)}`.split("\n"),
      ];
    });

    render(
      { type: "check-circle" },
      { type: "text", text: "Removed." },
    );

    // ページを開く
    for (const page of result.pages) {
      switch (page.mode) {
        case "self":
          if (page.project === scrapbox.Project.name) {
            openInTheSameTab(page.project, page.title);
          } else {
            // UserScriptを再読込させる
            window.open(
              `https://scrapbox.io/${page.project}/${
                encodeTitleURI(page.title)
              }`,
              "_self",
            );
          }
          break;
        case "newtab":
          window.open(
            `https://scrapbox.io/${page.project}/${encodeTitleURI(page.title)}`,
          );
          break;
      }
    }
  } catch (e: unknown) {
    render(
      { type: "exclamation-triangle" },
      { type: "text", text: "Failed to create new pages (see console)." },
    );
    console.error(e);
  } finally {
    const waiting = sleep(1000);
    if (socket) await disconnect(socket);
    await waiting;
    dispose();
  }
};
