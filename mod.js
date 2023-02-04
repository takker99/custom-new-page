// ported from https://scrapbox.io/takker/custom-new-page
import { cursor } from "https://scrapbox.io/api/code/takker/scrapbox-cursor-position-4/script.js";
import {
  goHead,
  goLine,
} from "https://scrapbox.io/api/code/takker/scrapbox-edit-emulation/script.js";
import { press } from "https://scrapbox.io/api/code/takker/scrapbox-keyboard-emulation-2/script.js";
import { insertText } from "https://scrapbox.io/api/code/takker/scrapbox-insert-text/script.js";

export function isolate(
  { leftText = getLeavingText, newPages = getNewPagesData } = {},
) {
  // 現在行番号を取得する
  const cline = cursor().line;
  const firstLineNo = cline.index;
  const lastLineNo = firstLineNo + cline.indentBlockLength;

  // テキストを取得する
  const texts = scrapbox.Page.lines.slice(firstLineNo, lastLineNo + 1)
    .map((line) => line.text);

  // 元のページの文字を置換する
  goLine(cline.id);
  goHead();
  press("End", { shiftKey: true });
  for (let i = firstLineNo; i < lastLineNo; i++) {
    press("ArrowDown", { shiftKey: true });
    press("End", { shiftKey: true }); // Endをおして折返し行を確実に全て選択する
  }
  const text = leftText({
    texts,
    index: firstLineNo,
    project: scrapbox.Project.name,
    title: scrapbox.Page.title,
  });
  const pagesData = newPages({
    texts,
    index: firstLineNo,
    project: scrapbox.Project.name,
    title: scrapbox.Page.title,
  });
  if (text === undefined) return;
  insertText({ text });

  // 個別のpageに切り出す
  for (const { project, title: targetTitle, bodies } of pagesData) {
    const _title = encodeURIComponent(targetTitle);
    const body = encodeURIComponent(bodies.join("\n"));
    window.open(`https://scrapbox.io/${project}/${_title}?body=${body}`);
  }
}
function getLeavingText({ texts, index, project, title }) {
  const link = texts[0].replace(/[\[\]]/g, "").trim();
  return `${texts[0].replace(/^(\s*).*$/, "$1")}[${link}]`;
}
function getNewPagesData({ texts, project }) {
  const link = texts[0].replace(/[\[\]]/g, "");

  const minIndentNum = Math.min(
    ...texts.map((text) => text.match(/^\s*/)[0].length),
  );
  const bodies = [
    `from [${scrapbox.Page.title}]`,
    ...texts.map((text) =>
      text.slice(
        minIndentNum > 1 ? minIndentNum - 1 : minIndentNum,
      )
    ),
  ];

  return [{
    project,
    title: link,
    bodies,
  }];
}
export function cutIndent(texts) {
  const minIndentNum = Math.min(
    ...texts.map((text) => text.match(/^\s*/)[0].length),
  );
  return texts.map((text) => text.slice(minIndentNum));
}
