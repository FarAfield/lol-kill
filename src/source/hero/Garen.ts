function importModule() {
  return {
    type: "hero",
    id: "Garen",
    title: "德玛西亚之力",
    name: "盖伦",
    avatar: "Garen.png",
    skins: [
      { name: "default", skin: "Garen_0.jpg" },
      { name: "战神阿瑞斯 盖伦", skin: "Garen_1.jpg" },
      { name: "黄金骑士 盖伦", skin: "Garen_2.jpg" },
      { name: "铁甲雄心 盖伦", skin: "Garen_3.jpg" },
      { name: "死亡骑士 盖伦", skin: "Garen_4.jpg" },
      { name: "孤高游侠 盖伦", skin: "Garen_5.jpg" },
      { name: "钢铁军团 盖伦", skin: "Garen_6.jpg" },
      { name: "海上霸主 盖伦", skin: "Garen_10.jpg" },
      { name: "张辽 文远", skin: "Garen_11.jpg" },
      { name: "神王 盖伦", skin: "Garen_13.jpg" },
      { name: "德玛西亚警官 盖伦", skin: "Garen_14.jpg" },
      { name: "王国机神玄武 盖伦", skin: "Garen_22.jpg" },
      { name: "至臻 王国机神玄武 盖伦", skin: "Garen_23.jpg" },
      { name: "战斗学院 盖伦", skin: "Garen_24.jpg" },
      { name: "剪纸仙灵 盖伦", skin: "Garen_33.jpg" },
      { name: "堕落神王 盖伦", skin: "Garen_44.jpg" },
    ],
    spells: [
      { id: "GarenP", name: "坚韧", icon: "GarenP.png", description: "" },
      { id: "GarenQ", name: "致命打击", icon: "GarenQ.png", description: "" },
      { id: "GarenW", name: "勇气", icon: "GarenW.png", description: "" },
      { id: "GarenE", name: "审判", icon: "GarenE.png", description: "" },
      {
        id: "GarenR",
        name: "德玛西亚正义",
        icon: "GarenR.png",
        description: "",
      },
    ],
    effects: {
      GarenP: null,
      GarenQ: null,
      GarenW: null,
      GarenE: null,
      GarenR: null,
    },
  };
}
export { importModule };
