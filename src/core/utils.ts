function dynamicImportModule(
  packageName: string,
  fileName: string
): Promise<{ importModule: Function }> {
  const importModule = import(`@/source/${packageName}/${fileName}.ts`);
  return new Promise((resolve, reject) => {
    importModule.then((module) => resolve(module)).catch((err) => reject(err));
  });
}
function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
function getUniqueRandomNumbers(min: number, max: number, num: number) {
  if (num > max - min + 1) {
    return [];
  }
  const numbers = new Set<number>();
  while (numbers.size < num) {
    const randomNum = getRandomNumber(min, max);
    numbers.add(randomNum);
  }
  return Array.from(numbers);
}

export { dynamicImportModule, getRandomNumber, getUniqueRandomNumbers };
