function importModule() {
  return {
    type: "hero",
    id: "Jax",
    title: "武器大师",
    name: "贾克斯",
    avatar: "Jax.png",
    skins: [
      { name: "default", skin: "Jax_0.jpg" },
      { name: "冰球队员 贾克斯", skin: "Jax_1.jpg" },
      { name: "万夫莫开 贾克斯", skin: "Jax_2.jpg" },
      { name: "宗师级钓鱼训练师 贾克斯", skin: "Jax_3.jpg" },
      { name: "卧虎藏龙 贾克斯", skin: "Jax_4.jpg" },
      { name: "百夫长 贾克斯", skin: "Jax_5.jpg" },
      { name: "少林武僧 贾克斯", skin: "Jax_6.jpg" },
      { name: "复仇武神 贾克斯", skin: "Jax_7.jpg" },
      { name: "SKT T1 贾克斯", skin: "Jax_8.jpg" },
      { name: "光明骑士 贾克斯", skin: "Jax_12.jpg" },
      { name: "武神 贾克斯", skin: "Jax_13.jpg" },
      { name: "王国机神白虎 贾克斯", skin: "Jax_14.jpg" },
      { name: "征服者 贾克斯", skin: "Jax_20.jpg" },
      { name: "至臻 征服者 贾克斯", skin: "Jax_21.jpg" },
      { name: "至高天 贾克斯", skin: "Jax_22.jpg" },
      { name: "新卧虎藏龙 贾克斯", skin: "Jax_32.jpg" },
      { name: "源计划：孤狼 贾克斯", skin: "Jax_33.jpg" },
    ],
    spells: [
      { id: "JaxP", name: "无情连打", icon: "JaxP.png", description: "" },
      { id: "JaxQ", name: "跳斩", icon: "JaxQ.png", description: "" },
      { id: "JaxW", name: "蓄力一击", icon: "JaxW.png", description: "" },
      { id: "JaxE", name: "反击风暴", icon: "JaxE.png", description: "" },
      { id: "JaxR", name: "武器大师", icon: "JaxR.png", description: "" },
    ],
    effects: { JaxP: null, JaxQ: null, JaxW: null, JaxE: null, JaxR: null },
  };
}
export { importModule };
