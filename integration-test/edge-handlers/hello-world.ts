var _ = require("lodash");

export async function onRequest(ev: Netlify.Event) {
  const req = await ev.getRequest();
  const arr = _.concat([1, 2, 3], 4, [5]);
  console.log(arr);
}
