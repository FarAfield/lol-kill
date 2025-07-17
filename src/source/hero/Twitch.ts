function importModule() {
  return {
    type: "hero",
    id: "Twitch",
    title: "瘟疫之源",
    name: "图奇",
    avatar: "Twitch.png",
    skins: [
      { name: "default", skin: "Twitch_0.jpg" },
      { name: "首领 图奇", skin: "Twitch_1.jpg" },
      { name: "北风冻原 图奇", skin: "Twitch_2.jpg" },
      { name: "都铎王朝 图奇", skin: "Twitch_3.jpg" },
      { name: "黑金诱惑 图奇", skin: "Twitch_4.jpg" },
      { name: "横行霸道 图奇", skin: "Twitch_5.jpg" },
      { name: "绝影神偷 图奇", skin: "Twitch_6.jpg" },
      { name: "SSW 图奇", skin: "Twitch_7.jpg" },
      { name: "欧米伽小队 毒针狙击手", skin: "Twitch_8.jpg" },
      { name: "狂心冰王 图奇", skin: "Twitch_12.jpg" },
      { name: "图奇 · 影足", skin: "Twitch_27.jpg" },
      { name: "屠龙勇士 图奇", skin: "Twitch_36.jpg" },
      { name: "西部魔影 送葬人 图奇", skin: "Twitch_45.jpg" },
      { name: "奶酪首领 图奇", skin: "Twitch_55.jpg" },
    ],
    spells: [
      { id: "TwitchP", name: "死亡毒液", icon: "TwitchP.png", description: "" },
      { id: "TwitchQ", name: "埋伏", icon: "TwitchQ.png", description: "" },
      { id: "TwitchW", name: "剧毒之桶", icon: "TwitchW.png", description: "" },
      { id: "TwitchE", name: "毒性爆发", icon: "TwitchE.png", description: "" },
      { id: "TwitchR", name: "火力全开", icon: "TwitchR.png", description: "" },
    ],
    effects: {
      TwitchP: null,
      TwitchQ: null,
      TwitchW: null,
      TwitchE: null,
      TwitchR: null,
    },
  };
}
export { importModule };
