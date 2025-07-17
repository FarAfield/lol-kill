function importModule() {
  return {
    type: "hero",
    id: "Khazix",
    title: "虚空掠夺者",
    name: "卡兹克",
    avatar: "Khazix.png",
    skins: [
      { name: "default", skin: "Khazix_0.jpg" },
      { name: "霸天异形 卡兹克", skin: "Khazix_1.jpg" },
      { name: "沙之守护 卡兹克", skin: "Khazix_2.jpg" },
      { name: "死亡绽放 卡兹克", skin: "Khazix_3.jpg" },
      { name: "暗星 卡兹克", skin: "Khazix_4.jpg" },
      { name: "冠军掠夺者 卡兹克", skin: "Khazix_11.jpg" },
      { name: "奥德赛 卡兹克", skin: "Khazix_60.jpg" },
      { name: "春晖海神 卡兹克", skin: "Khazix_69.jpg" },
      { name: "水晶掠夺者 卡兹克", skin: "Khazix_79.jpg" },
    ],
    spells: [
      { id: "KhazixP", name: "无形威胁", icon: "KhazixP.png", description: "" },
      { id: "KhazixQ", name: "品尝恐惧", icon: "KhazixQ.png", description: "" },
      { id: "KhazixW", name: "虚空突刺", icon: "KhazixW.png", description: "" },
      { id: "KhazixE", name: "跃击", icon: "KhazixE.png", description: "" },
      { id: "KhazixR", name: "虚空来袭", icon: "KhazixR.png", description: "" },
    ],
    effects: {
      KhazixP: null,
      KhazixQ: null,
      KhazixW: null,
      KhazixE: null,
      KhazixR: null,
    },
  };
}
export { importModule };
