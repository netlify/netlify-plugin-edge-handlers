// eslint-disable-next-line you-dont-need-lodash-underscore/concat
import { concat } from "lodash";

import td from "./data/states.json";

export async function onRequest(ev) {
  const req = await ev.getRequest();
  const state = req.headers.get("X-NF-Subdivision-Code");
  const data = state && td.find((el) => el.state === state);
  const array = [1];
  const other = concat(array, 2, [3], [4], data.positive);
  console.log(other);
}
