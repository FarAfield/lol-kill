function importModule() {
  return [
    {
      type: "sword",
      id: "BloodThirstSword",
      name: "饮血剑",
      image: "BloodThirstSword.png",
      description: "",
      effects: {
        BloodThirstSword: () => {},
      },
    },
  ];
}

export { importModule };
