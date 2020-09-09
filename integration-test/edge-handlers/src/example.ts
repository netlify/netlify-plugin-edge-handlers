import { formatDistance, subDays } from "date-fns";

export async function onRequest(ev: Netlify.Event) {
  const req = await ev.getRequest();
  const timePassed = formatDistance(subDays(new Date(), 3), new Date());
  console.log(timePassed);
}
