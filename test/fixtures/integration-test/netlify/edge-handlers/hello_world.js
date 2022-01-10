import td from './data/states.json'

export async function onRequest(ev) {
  const req = await ev.getRequest()
  const state = req.headers.get('X-NF-Subdivision-Code')
  const data = state && td.find((el) => el.state === state)
  const array = [1]
  // eslint-disable-next-line unicorn/prefer-spread
  const other = [...array, 2, 3, 4].concat(data.positive)
  console.log(other)
}
