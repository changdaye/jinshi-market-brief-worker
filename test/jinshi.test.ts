import { describe, expect, it } from "vitest";
import { parseHomepageFlashItems, parseJinshiTimestampFromId, parseRelativeTimeText, parseXnewsItems } from "../src/services/jinshi";

const homepageFixture = `
<div id="flash20260423194512431800" class="jin-flash-item-container is-normal">
  <div class="jin-flash-item article is-important">
    <div class="flash-text"><b>欧盟正式批准向乌克兰发放900亿欧元贷款，并通过对俄罗斯第20轮制裁方案。</b></div>
    <div class="flash-remark"><a href="https://xnews.jin10.com/topic/373" class="remark-item topic"><span class="remark-item-title">跟踪俄乌冲突局势</span></a></div>
    <a href="https://xnews.jin10.com/details/217456" target="_blank">详情</a>
  </div>
</div>
<div id="flash20260423194420123400" class="jin-flash-item-container is-normal">
  <div class="jin-flash-item article">
    <div class="flash-text">美国总统表示，将持续关注通胀数据。</div>
    <a href="https://xnews.jin10.com/details/217455" target="_blank">详情</a>
  </div>
</div>`;

const xnewsFixture = `
<div data-id="217468" data-index="0" class="jin10-news-list-item hastags news">
  <a href="https://xnews.jin10.com/details/217468" target="_blank"><p class="jin10-news-list-item-title">沃什的变革如何起步？前美联储“三把手”支招：学欧洲，告别点阵图！</p></a>
  <div class="jin10-news-list-item-introduction">前纽联储主席杜德利指出，变革的首要突破口应是效仿欧洲央行的沟通模式。</div>
  <div class="jin10-news-list-item-footer">
    <span class="jin10-news-img-new">NEW</span>
    <span class="jin10-news-list-item-display_datetime"><svg></svg><span>2分钟前</span></span>
    <span class="jin10-news-list-item-topic inline">来自：<span class="open-link">订阅美联储动态</span></span>
  </div>
</div>
<div data-id="217466" data-index="1" class="jin10-news-list-item hastags news">
  <a href="https://xnews.jin10.com/details/217466" target="_blank"><p class="jin10-news-list-item-title">无解死局？沃什想当美联储主席，只剩特朗普“认怂”一条路</p></a>
  <div class="jin10-news-list-item-introduction">理论上存在程序性办法，但几乎不具备现实可行性。</div>
  <div class="jin10-news-list-item-footer">
    <span class="jin10-news-list-item-display_datetime"><svg></svg><span>1小时前</span></span>
  </div>
</div>`;

describe("parseJinshiTimestampFromId", () => {
  it("turns flash ids into Beijing timestamp strings", () => {
    expect(parseJinshiTimestampFromId("20260423194512")).toBe("2026-04-23T19:45:12+08:00");
  });
});

describe("parseHomepageFlashItems", () => {
  it("extracts flash content, links and importance from homepage HTML", () => {
    const items = parseHomepageFlashItems(homepageFixture, 10);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "flash-20260423194512",
      sourceType: "flash",
      title: "欧盟正式批准向乌克兰发放900亿欧元贷款，并通过对俄罗斯第20轮制裁方案。",
      link: "https://xnews.jin10.com/details/217456",
      important: true,
      topic: "跟踪俄乌冲突局势",
      rawTimeText: "2026-04-23 19:45:12 +08:00"
    });
    expect(items[1].important).toBe(false);
  });
});

describe("parseXnewsItems", () => {
  it("extracts article title, intro, topic and relative time", () => {
    const now = new Date("2026-04-23T12:00:00.000Z");
    const items = parseXnewsItems(xnewsFixture, 10, now);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "news-217468",
      sourceType: "news",
      title: "沃什的变革如何起步？前美联储“三把手”支招：学欧洲，告别点阵图！",
      summary: "前纽联储主席杜德利指出，变革的首要突破口应是效仿欧洲央行的沟通模式。",
      link: "https://xnews.jin10.com/details/217468",
      important: true,
      topic: "订阅美联储动态",
      rawTimeText: "2分钟前"
    });
    expect(items[1].rawTimeText).toBe("1小时前");
  });
});

describe("parseRelativeTimeText", () => {
  it("supports minute-based relative time strings", () => {
    const now = new Date("2026-04-23T12:00:00.000Z");
    expect(parseRelativeTimeText("15分钟前", now)).toBe("2026-04-23T11:45:00.000Z");
  });

  it("supports hour-based relative time strings", () => {
    const now = new Date("2026-04-23T12:00:00.000Z");
    expect(parseRelativeTimeText("3小时前", now)).toBe("2026-04-23T09:00:00.000Z");
  });
});
