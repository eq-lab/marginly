export const log = (message: string): void => {
  console.error(message);
};

export const sectionLog = (message: string): void => {
  console.error(`\n${message}`);
};

export const subsectionLog = (message: string): void => {
  console.error(`  ${message}`);
};
