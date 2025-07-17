function importModule() {
  return {
    type: "hero",
    id: "Kennen",
    title: "狂暴之心",
    name: "凯南",
    avatar: "Kennen.png",
    skins: [
      { name: "default", skin: "Kennen_0.jpg" },
      { name: "红色彗星 凯南", skin: "Kennen_1.jpg" },
      { name: "银色闪电 凯南", skin: "Kennen_2.jpg" },
      { name: "空手道 凯南", skin: "Kennen_3.jpg" },
      { name: "医学博士 凯南", skin: "Kennen_4.jpg" },
      { name: "刺客信条 凯南", skin: "Kennen_5.jpg" },
      { name: "腥红之月 凯南", skin: "Kennen_6.jpg" },
      { name: "超级英雄 凯南", skin: "Kennen_7.jpg" },
      { name: "奈落之炎 凯南", skin: "Kennen_8.jpg" },
      { name: "DWG 凯南", skin: "Kennen_23.jpg" },
      { name: "宇航员 凯南", skin: "Kennen_25.jpg" },
    ],
    spells: [
      {
        id: "KennenP",
        name: "【忍法！雷缚印】",
        icon: "KennenP.png",
        description: "",
      },
      {
        id: "KennenQ",
        name: "奥义！千鸟",
        icon: "KennenQ.png",
        description: "",
      },
      {
        id: "KennenW",
        name: "奥义！电刃",
        icon: "KennenW.png",
        description: "",
      },
      {
        id: "KennenE",
        name: "奥义！雷铠",
        icon: "KennenE.png",
        description: "",
      },
      {
        id: "KennenR",
        name: "秘奥义！万雷天牢引",
        icon: "KennenR.png",
        description: "",
      },
    ],
    effects: {
      KennenP: null,
      KennenQ: null,
      KennenW: null,
      KennenE: null,
      KennenR: null,
    },
  };
}
export { importModule };
