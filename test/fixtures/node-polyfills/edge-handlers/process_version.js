import process from "process";

export const onRequest = () => {
  console.log("Process version is: " + process.version);
};
