// ported from https://scrapbox.io/takker/custom-new-page-2
import { position } from "https://scrapbox.io/api/code/takker/scrapbox-cursor-position-7/script.js";
import {
  getIndentLineCount,
  getLineNo,
} from "https://scrapbox.io/api/code/takker/scrapbox-access-nodes@0.1.0/script.js";
import {
  goHead,
} from "https://scrapbox.io/api/code/takker/scrapbox-motion-emulation/script.js";
import { press } from "https://scrapbox.io/api/code/takker/scrapbox-keyboard-emulation-2/script.js";
import { insertText } from "https://scrapbox.io/api/code/takker/scrapbox-insert-text-2/script.js";

export async function isolate(settings) {
  // 現在行番号を取得する
  const cline = position().line;
  const firstLineNo = getLineNo(cline);
  const lastLineNo = firstLineNo + getIndentLineCount(cline);

  // テキストを取得する
  const lines = scrapbox.Page.lines.slice(firstLineNo, lastLineNo + 1)
    .map((line) => line.text);

  // 使用する設定を決める
  const { leftText, newPages } = settings
    .find(({ judge }) => judge(lines)) ??
    // default setting
    { leftText: getLeavingText, newPages: getNewPagesData };
  const option = {
    index: firstLineNo,
    project: scrapbox.Project.name,
    title: scrapbox.Page.title,
  };

  // 元のページの文字を置換する
  goHead();
  press("End", { shiftKey: true });
  for (let i = firstLineNo; i < lastLineNo; i++) {
    press("ArrowDown", { shiftKey: true });
    press("End", { shiftKey: true }); // Endをおして折返し行を確実に全て選択する
  }
  // textを編集する前にデータを作っておく
  const text = leftText(lines, option);
  const pages = newPages(lines, option);
  await insertText(text);

  // 個別のpageに切り出す
  for (const { project, title, body } of pages) {
    window.open(
      `https://scrapbox.io/${project}/${encodeURIComponent(title)}?body=${
        encodeURIComponent(body)
      }`,
    );
  }
}
function getLeavingText(texts) {
  const link = texts[0].replace(/[\[\]]/g, "").trim();
  return `${texts[0].match(/^(\s*)/)[1]}[${link}]`;
}
function getNewPagesData(texts, _, { project, title }) {
  const link = texts[0].replace(/[\[\]]/g, "").trim();

  const minIndentNum = Math.min(
    ...texts.map((text) => text.match(/^\s*/)[0].length),
  );
  const body = [
    `from [${title}]`,
    ...texts.map((text) =>
      text.slice(
        minIndentNum > 1 ? minIndentNum - 1 : minIndentNum,
      )
    ),
  ].join("\n");
  console.log([project, link, body]);
  return [{
    project,
    title: link,
    body,
  }];
}
export function cutIndent(texts) {
  const minIndentNum = Math.min(
    ...texts.map((text) => text.match(/^\s*/)[0].length),
  );
  return texts.map((text) => text.slice(minIndentNum));
}
