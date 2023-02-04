// ported from https://scrapbox.io/takker/custom-new-page-3
import type { Line, patch } from "./deps/scrapbox.ts";
import { getIndentCount } from "./deps/scrapbox.ts";

export type Updater = Parameters<typeof patch>[2];

/** 切り出したページを開く方法
 *
 * - "self": 同じページで開く
 * - "newtab": 新しいページで開く
 * - "noopen": 開かない
 */
export type OpenMode = "self" | "newtab" | "noopen";

/** 一つのページを表すデータ */
export interface Page {
  /** ページのproject */
  project: string;

  /** ページタイトル */
  title: string;

  /** 配列のとき：タイトルを **含まない** ページ本文
   *
   *  - すでに本文があるときは、末尾に追記される
   *
   *  関数のとき：タイトルを **含む** 本文を返す関数
   */
  lines: string[] | Updater;

  /** 切り出したページを開く方法
   *
   * `newPage()`に渡された設定をこれで上書きできる
   */
  mode: OpenMode;
}

/** 切り出し時の書式設定を行う関数
 *
 * @param text 切り出す文字列
 * @param options `newPage()`で渡されたhooks以外の情報
 * @return 新規作成するページ情報とかを返す。もし条件に一致しないなどで切り出さない場合は`undefined`を返す
 */
export type NewPageHook = (
  text: string,
  options: NewPageHookOptions,
) => Promise<NewPageHookResult | undefined> | NewPageHookResult | undefined;

export interface NewPageHookOptions {
  /** 切り出し元ページのtitle */
  title: string;

  /** 切り出し元project */
  projectFrom: string;

  /** 切り出し先project */
  projectTo: string;

  /** 切り出し範囲を含む行 */
  lines: Line[];

  /** 切り出したページを開く方法 */
  mode: OpenMode;
}

export interface NewPageHookResult {
  /** 元のページに残すテキスト */
  text: string;

  /** 切り出すページ */
  pages: Page[];
}

/** 何も設定されていないときに使われるhook
 *
 * 仕様はScrapboxのとほぼ同じ
 */
export const defaultHook: NewPageHook = (
  text,
  { title, projectTo, mode },
) => {
  const [rawTitle, ...lines] = text.split("\n");
  const newTitle = rawTitle.replaceAll("[", "").replaceAll("]", "").trim();

  // 余計なインデントを削る
  const minIndentNum = Math.min(
    ...[rawTitle, ...lines].map((line) => getIndentCount(line)),
  );
  const newLines = [
    `from [${title}]`,
    rawTitle.slice(minIndentNum),
    ...lines.map(
      (line) => line.slice(minIndentNum),
    ),
  ];

  return {
    text: `[${newTitle}]`,
    pages: [{ project: projectTo, title: newTitle, lines: newLines, mode }],
  };
};
