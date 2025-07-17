function importModule() {
  return {
    type: "hero",
    id: "Pantheon",
    title: "不屈之枪",
    name: "潘森",
    avatar: "Pantheon.png",
    skins: [
      { name: "default", skin: "Pantheon_0.jpg" },
      { name: "斯巴达之魂 潘森", skin: "Pantheon_1.jpg" },
      { name: "万人敌 潘森", skin: "Pantheon_2.jpg" },
      { name: "英仙座珀尔修斯 潘森", skin: "Pantheon_3.jpg" },
      { name: "钢铁意志 潘森", skin: "Pantheon_4.jpg" },
      { name: "大夏武士 潘森", skin: "Pantheon_5.jpg" },
      { name: "屠龙勇士 潘森", skin: "Pantheon_6.jpg" },
      { name: "丧尸杀手 潘森", skin: "Pantheon_7.jpg" },
      { name: "面包之王 潘森", skin: "Pantheon_8.jpg" },
      { name: "未来战士 潘森", skin: "Pantheon_16.jpg" },
      { name: "破败军团 潘森", skin: "Pantheon_25.jpg" },
      { name: "至臻 飞升战神 潘森", skin: "Pantheon_26.jpg" },
      { name: "灰烬征服者 潘森", skin: "Pantheon_36.jpg" },
    ],
    spells: [
      {
        id: "PantheonP",
        name: "矢志不退",
        icon: "PantheonP.png",
        description: "",
      },
      {
        id: "PantheonQ",
        name: "贯星长枪",
        icon: "PantheonQ.png",
        description: "",
      },
      {
        id: "PantheonW",
        name: "斗盾跃击",
        icon: "PantheonW.png",
        description: "",
      },
      {
        id: "PantheonE",
        name: "神佑枪阵",
        icon: "PantheonE.png",
        description: "",
      },
      {
        id: "PantheonR",
        name: "大荒星陨",
        icon: "PantheonR.png",
        description: "",
      },
    ],
    effects: {
      PantheonP: null,
      PantheonQ: null,
      PantheonW: null,
      PantheonE: null,
      PantheonR: null,
    },
  };
}
export { importModule };
