function importModule() {
  return {
    type: "hero",
    id: "Nidalee",
    title: "狂野女猎手",
    name: "奈德丽",
    avatar: "Nidalee.png",
    skins: [
      { name: "default", skin: "Nidalee_0.jpg" },
      { name: "雪装 奈德丽", skin: "Nidalee_1.jpg" },
      { name: "丛林猎豹 奈德丽", skin: "Nidalee_2.jpg" },
      { name: "法国女仆 奈德丽", skin: "Nidalee_3.jpg" },
      { name: "艳后 奈德丽", skin: "Nidalee_4.jpg" },
      { name: "魅惑女巫 奈德丽", skin: "Nidalee_5.jpg" },
      { name: "铁血猎手 奈德丽", skin: "Nidalee_6.jpg" },
      { name: "枭姬 孙尚香", skin: "Nidalee_7.jpg" },
      { name: "勇者 奈德丽", skin: "Nidalee_8.jpg" },
      { name: "银河魔装机神 奈德丽", skin: "Nidalee_9.jpg" },
      { name: "黎明使者 奈德丽", skin: "Nidalee_11.jpg" },
      { name: "狮子星神 奈德丽", skin: "Nidalee_18.jpg" },
      { name: "DWG 奈德丽", skin: "Nidalee_27.jpg" },
      { name: "海之歌 奈德丽", skin: "Nidalee_29.jpg" },
      { name: "喵大力", skin: "Nidalee_39.jpg" },
      { name: "灵之菊 奈德丽", skin: "Nidalee_48.jpg" },
    ],
    spells: [
      { id: "NidaleeP", name: "寻觅", icon: "NidaleeP.png", description: "" },
      {
        id: "NidaleeQ",
        name: "标枪投掷 / 推倒",
        icon: "NidaleeQ.png",
        description: "",
      },
      {
        id: "NidaleeW",
        name: "丛林伏击 / 猛扑",
        icon: "NidaleeW.png",
        description: "",
      },
      {
        id: "NidaleeE",
        name: "野性奔腾 / 挥击",
        icon: "NidaleeE.png",
        description: "",
      },
      {
        id: "NidaleeR",
        name: "美洲狮形态",
        icon: "NidaleeR.png",
        description: "",
      },
    ],
    effects: {
      NidaleeP: null,
      NidaleeQ: null,
      NidaleeW: null,
      NidaleeE: null,
      NidaleeR: null,
    },
  };
}
export { importModule };
