// ported from https://scrapbox.io/takker/custom-new-page-3
import {
  caret,
  CaretInfo,
  getIndentLineCount,
  getText,
  Scrapbox,
} from "./deps/scrapbox.ts";
declare const scrapbox: Scrapbox;

/** 選択範囲があればそれを返し、なければその行にぶら下がるインデントの塊を返す
 *
 * 選択範囲の行番号は、予め若いほうが`start`になるよう調整しておく
 */
export const getSelection = (): Omit<CaretInfo, "position"> => {
  if (scrapbox.Layout !== "page") {
    return {
      selectionRange: {
        start: { line: 0, char: 0 },
        end: { line: 0, char: 0 },
      },
      selectedText: "",
    };
  }
  const { selectionRange, selectedText, position } = caret();
  if (!selectedText) {
    const count = getIndentLineCount(position.line) ?? 0;
    const selectionRange = {
      start: {
        line: position.line,
        char: 0,
      },
      end: {
        line: position.line + count,
        char: getText(position.line + count)?.length ?? 0,
      },
    };

    return {
      selectionRange,
      selectedText: scrapbox.Page.lines.slice(
        selectionRange.start.line,
        selectionRange.end.line + 1,
      ).map((line) => line.text).join("\n"),
    };
  }
  const { start, end } = selectionRange;
  const larger = start.line > end.line;
  const startLine = larger ? end.line : start.line;
  const startChar = larger ? end.char : start.char; // この番号の文字から含む
  const endLine = larger ? start.line : end.line;
  const endChar = larger ? start.char : end.char; // この番号以降の文字は含まない

  return {
    selectedText,
    selectionRange: {
      start: {
        line: startLine,
        char: startChar,
      },
      end: {
        line: endLine,
        char: endChar,
      },
    },
  };
};
