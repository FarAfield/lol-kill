function importModule() {
  return {
    type: "hero",
    id: "Heimerdinger",
    title: "大发明家",
    name: "黑默丁格",
    avatar: "Heimerdinger.png",
    skins: [
      { name: "default", skin: "Heimerdinger_0.jpg" },
      { name: "第三类接触 黑默丁格", skin: "Heimerdinger_1.jpg" },
      { name: "拆弹专家 黑默丁格", skin: "Heimerdinger_2.jpg" },
      { name: "创意工坊 黑默丁格", skin: "Heimerdinger_3.jpg" },
      { name: "雪默丁格", skin: "Heimerdinger_4.jpg" },
      { name: "生化博士 黑默丁格", skin: "Heimerdinger_5.jpg" },
      { name: "驯龙学者 黑默丁格", skin: "Heimerdinger_6.jpg" },
      { name: "泳池派对 黑默丁格", skin: "Heimerdinger_15.jpg" },
      { name: "小蜜蜂 黑默丁格", skin: "Heimerdinger_24.jpg" },
    ],
    spells: [
      {
        id: "HeimerdingerP",
        name: "海克斯科技亲和",
        icon: "HeimerdingerP.png",
        description: "",
      },
      {
        id: "HeimerdingerQ",
        name: "H-28 G 进化炮台",
        icon: "HeimerdingerQ.png",
        description: "",
      },
      {
        id: "HeimerdingerW",
        name: "海克斯科技微型导弹",
        icon: "HeimerdingerW.png",
        description: "",
      },
      {
        id: "HeimerdingerE",
        name: "CH-2电子风暴手雷",
        icon: "HeimerdingerE.png",
        description: "",
      },
      {
        id: "HeimerdingerR",
        name: "升级！！！",
        icon: "HeimerdingerR.png",
        description: "",
      },
    ],
    effects: {
      HeimerdingerP: null,
      HeimerdingerQ: null,
      HeimerdingerW: null,
      HeimerdingerE: null,
      HeimerdingerR: null,
    },
  };
}
export { importModule };
