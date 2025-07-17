function importModule() {
  return {
    type: "hero",
    id: "Corki",
    title: "英勇投弹手",
    name: "库奇",
    avatar: "Corki.png",
    skins: [
      { name: "default", skin: "Corki_0.jpg" },
      { name: "外星装甲 库奇", skin: "Corki_1.jpg" },
      { name: "雪橇速滑 库奇", skin: "Corki_2.jpg" },
      { name: "红色男爵 库奇", skin: "Corki_3.jpg" },
      { name: "急速前进 库奇", skin: "Corki_4.jpg" },
      { name: "海牛骑手  库奇", skin: "Corki_5.jpg" },
      { name: "神龙之翼 库奇", skin: "Corki_6.jpg" },
      { name: "Fnatic 库奇", skin: "Corki_7.jpg" },
      { name: "电玩上校 库奇", skin: "Corki_8.jpg" },
      { name: "柯基 库奇", skin: "Corki_18.jpg" },
      { name: "宇航员 库奇", skin: "Corki_26.jpg" },
    ],
    spells: [
      {
        id: "CorkiP",
        name: "海克斯科技军备",
        icon: "CorkiP.png",
        description: "",
      },
      { id: "CorkiQ", name: "磷光炸弹", icon: "CorkiQ.png", description: "" },
      {
        id: "CorkiW",
        name: "瓦尔基里俯冲",
        icon: "CorkiW.png",
        description: "",
      },
      { id: "CorkiE", name: "格林机枪", icon: "CorkiE.png", description: "" },
      { id: "CorkiR", name: "火箭轰击", icon: "CorkiR.png", description: "" },
    ],
    effects: {
      CorkiP: null,
      CorkiQ: null,
      CorkiW: null,
      CorkiE: null,
      CorkiR: null,
    },
  };
}
export { importModule };
