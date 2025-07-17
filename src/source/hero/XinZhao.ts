function importModule() {
  return {
    type: "hero",
    id: "XinZhao",
    title: "德邦总管",
    name: "赵信",
    avatar: "XinZhao.png",
    skins: [
      { name: "default", skin: "XinZhao_0.jpg" },
      { name: "特战先锋 赵信", skin: "XinZhao_1.jpg" },
      { name: "皇家守卫 赵信", skin: "XinZhao_2.jpg" },
      { name: "绞肉机角斗士 赵信", skin: "XinZhao_3.jpg" },
      { name: "翼骑统领 赵信", skin: "XinZhao_4.jpg" },
      { name: "赵云 子龙", skin: "XinZhao_5.jpg" },
      { name: "秘密特工 赵信", skin: "XinZhao_6.jpg" },
      { name: "屠龙勇士 赵信", skin: "XinZhao_13.jpg" },
      { name: "穿星魔锋 赵信", skin: "XinZhao_20.jpg" },
      { name: "黑暗骑士 赵信", skin: "XinZhao_27.jpg" },
      { name: "猛虎下山 赵信", skin: "XinZhao_36.jpg" },
    ],
    spells: [
      { id: "XinZhaoP", name: "果决", icon: "XinZhaoP.png", description: "" },
      {
        id: "XinZhaoQ",
        name: "三重爪击",
        icon: "XinZhaoQ.png",
        description: "",
      },
      {
        id: "XinZhaoW",
        name: "风斩电刺",
        icon: "XinZhaoW.png",
        description: "",
      },
      {
        id: "XinZhaoE",
        name: "无畏冲锋",
        icon: "XinZhaoE.png",
        description: "",
      },
      {
        id: "XinZhaoR",
        name: "新月护卫",
        icon: "XinZhaoR.png",
        description: "",
      },
    ],
    effects: {
      XinZhaoP: null,
      XinZhaoQ: null,
      XinZhaoW: null,
      XinZhaoE: null,
      XinZhaoR: null,
    },
  };
}
export { importModule };
