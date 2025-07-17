function importModule() {
  return {
    type: "hero",
    id: "Anivia",
    title: "冰晶凤凰",
    name: "艾尼维亚",
    avatar: "Anivia.png",
    skins: [
      { name: "default", skin: "Anivia_0.jpg" },
      { name: "双重冰晶 艾尼维亚", skin: "Anivia_1.jpg" },
      { name: "联盟之喙 艾尼维亚", skin: "Anivia_2.jpg" },
      { name: "重甲猎鹰 艾尼维亚", skin: "Anivia_3.jpg" },
      { name: "钢铁之翼 艾尼维亚", skin: "Anivia_4.jpg" },
      { name: "黯晶凤凰 艾尼维亚", skin: "Anivia_5.jpg" },
      { name: "翼龙 艾尼维亚", skin: "Anivia_6.jpg" },
      { name: "庆典女皇 艾尼维亚", skin: "Anivia_7.jpg" },
      { name: "千纸凤凰 艾尼维亚", skin: "Anivia_8.jpg" },
      { name: "凤凰星神 艾尼维亚", skin: "Anivia_17.jpg" },
      { name: "神凰行者 瑞羽圣凰 艾尼维亚", skin: "Anivia_27.jpg" },
      { name: "魅惑女巫 艾尼维亚", skin: "Anivia_37.jpg" },
      { name: "胜利凤凰 艾尼维亚", skin: "Anivia_46.jpg" },
    ],
    spells: [
      { id: "AniviaP", name: "寒霜涅槃", icon: "AniviaP.png", description: "" },
      { id: "AniviaQ", name: "寒冰闪耀", icon: "AniviaQ.png", description: "" },
      { id: "AniviaW", name: "寒冰屏障", icon: "AniviaW.png", description: "" },
      { id: "AniviaE", name: "霜寒刺骨", icon: "AniviaE.png", description: "" },
      { id: "AniviaR", name: "冰川风暴", icon: "AniviaR.png", description: "" },
    ],
    effects: {
      AniviaP: null,
      AniviaQ: null,
      AniviaW: null,
      AniviaE: null,
      AniviaR: null,
    },
  };
}
export { importModule };
