function importModule() {
  return {
    type: "hero",
    id: "Malphite",
    title: "熔岩巨兽",
    name: "墨菲特",
    avatar: "Malphite.png",
    skins: [
      { name: "default", skin: "Malphite_0.jpg" },
      { name: "三叶草 墨菲特", skin: "Malphite_1.jpg" },
      { name: "珊瑚礁 墨菲特", skin: "Malphite_2.jpg" },
      { name: "石破天惊 墨菲特", skin: "Malphite_3.jpg" },
      { name: "黑曜石守护者 墨菲特", skin: "Malphite_4.jpg" },
      { name: "冰川巨兽 墨菲特", skin: "Malphite_5.jpg" },
      { name: "霸天巨兽 墨菲特", skin: "Malphite_6.jpg" },
      { name: "无畏号 墨菲特", skin: "Malphite_7.jpg" },
      { name: "奥德赛 墨菲特", skin: "Malphite_16.jpg" },
      { name: "暗星 墨菲特", skin: "Malphite_23.jpg" },
      { name: "至臻 暗星 墨菲特", skin: "Malphite_24.jpg" },
      { name: "FPX 墨菲特", skin: "Malphite_25.jpg" },
      { name: "古神 墨菲特", skin: "Malphite_27.jpg" },
      { name: "春晖山神 墨菲特", skin: "Malphite_37.jpg" },
    ],
    spells: [
      {
        id: "MalphiteP",
        name: "花岗岩护盾",
        icon: "MalphiteP.png",
        description: "",
      },
      {
        id: "MalphiteQ",
        name: "地震碎片",
        icon: "MalphiteQ.png",
        description: "",
      },
      {
        id: "MalphiteW",
        name: "雷霆拍击",
        icon: "MalphiteW.png",
        description: "",
      },
      {
        id: "MalphiteE",
        name: "大地震颤",
        icon: "MalphiteE.png",
        description: "",
      },
      {
        id: "MalphiteR",
        name: "势不可挡",
        icon: "MalphiteR.png",
        description: "",
      },
    ],
    effects: {
      MalphiteP: null,
      MalphiteQ: null,
      MalphiteW: null,
      MalphiteE: null,
      MalphiteR: null,
    },
  };
}
export { importModule };
