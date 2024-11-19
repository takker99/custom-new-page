// ported from https://scrapbox.io/takker/custom-new-page-3
import {
  connect,
  disconnect,
  encodeTitleURI,
  openInTheSameTab,
  patch,
  type Scrapbox,
  type ScrapboxSocket,
  takeInternalLines,
  useStatusBar,
} from "./deps/scrapbox.ts";
import { getSelection } from "./selection.ts";
import { defaultHook, NewPageHook, OpenMode, Updater } from "./hook.ts";
import { delay } from "jsr:@std/async@1/delay";
import { isErr, unwrapErr, unwrapOk } from "npm:option-t@50/plain_result";
declare const scrapbox: Scrapbox;
export type {
  NewPageHook,
  NewPageHookOptions,
  NewPageHookResult,
  OpenMode,
  Page,
  Updater,
} from "./hook.ts";

export interface MakeNewPageInit {
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

  /** 通信に使うsocket */
  socket?: ScrapboxSocket;
}

/** 切り出しを実行する関数 */
export interface MakeNewPageResult {
  /** 使用するhookの名前 */
  hookName: string;

  (): Promise<void>;
}

export const makeNewPage = (
  init?: MakeNewPageInit,
): MakeNewPageResult | undefined => {
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
  const result = (() => {
    for (const hook of hooks) {
      const result = hook(selectedText, {
        title: scrapbox.Page.title,
        projectFrom: scrapbox.Project.name,
        projectTo: project,
        lines: takeInternalLines().slice(start.line, end.line + 1),
        mode,
      });
      if (result) return [hook.hookName, result] as const;
    }
  })();

  // 切り出せる状態でなければ何もしない
  if (!result) return;
  const [hookName, promise] = result;

  const cut = async () => {
    const result = promise instanceof Promise ? await promise : promise;

    // 切り出す文章も元のページを書き換えることもなければなにもしない
    if (result.pages.length === 0 && result.text === selectedText) return;

    // 個別のpageに切り出す
    let socket: ScrapboxSocket | undefined;
    const { render, dispose } = useStatusBar();
    try {
      if (result.pages.length > 0) {
        const length = result.pages.length;
        render(
          { type: "spinner" },
          { type: "text", text: `Create new ${length} pages...` },
        );
        const res = await connect(init?.socket);
        if (isErr(res)) throw unwrapErr(res);
        socket = unwrapOk(res);
        let counter = 0;
        await Promise.all(result.pages.map(
          async (page) => {
            const updater: Updater = Array.isArray(page.lines)
              ? (
                lines,
              ) => [
                ...lines.map((line) => line.text),
                ...(page.lines as string[]),
              ]
              : page.lines;
            await patch(page.project, page.title, updater, { socket });

            render(
              { type: "spinner" },
              {
                type: "text",
                text: `Create ${length - (++counter)} pages...`,
              },
            );
          },
        ));
      }
      render(
        { type: "spinner" },
        {
          type: "text",
          text: `${
            result.pages.length > 0 ? "Created. " : ""
          }Removing cut text...`,
        },
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
              globalThis.open(
                `https://scrapbox.io/${page.project}/${
                  encodeTitleURI(page.title)
                }`,
                "_self",
              );
            }
            break;
          case "newtab":
            globalThis.open(
              `https://scrapbox.io/${page.project}/${
                encodeTitleURI(page.title)
              }`,
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
      const waiting = delay(1000);
      if (socket) await disconnect(socket);
      await waiting;
      dispose();
    }
  };

  cut.hookName = hookName;

  return cut;
};
