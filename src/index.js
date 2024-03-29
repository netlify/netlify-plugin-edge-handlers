import { resolve } from 'path'
import { env } from 'process'

import { isDirectory } from 'path-type'

import { LOCAL_OUT_DIR } from './consts.js'
import { assemble, bundleFunctions, logHandlers, publishBundle } from './lib.js'

export const onBuild = async function ({
  constants: { IS_LOCAL, NETLIFY_API_TOKEN, NETLIFY_API_HOST, EDGE_HANDLERS_SRC },
  utils,
}) {
  if (!(await isDirectory(EDGE_HANDLERS_SRC))) {
    return utils.build.failBuild(`Edge Handlers directory does not exist: ${resolve(EDGE_HANDLERS_SRC)}`)
  }
  const { mainFile, handlers } = await assemble(EDGE_HANDLERS_SRC)

  if (handlers.length === 0) {
    console.log(`No Edge Handlers were found in ${EDGE_HANDLERS_SRC} directory`)
    return
  }

  logHandlers(handlers, EDGE_HANDLERS_SRC)
  const bundle = await bundleFunctions(mainFile, utils)
  const uploaded = await publishBundle(bundle, handlers, LOCAL_OUT_DIR, IS_LOCAL, NETLIFY_API_HOST, NETLIFY_API_TOKEN)

  if (!IS_LOCAL) {
    const summaryText = uploaded
      ? `${handlers.length} Edge Handlers deployed.`
      : `${handlers.length} Edge Handlers did not change.`
    const logsLink = `https://app.netlify.com/sites/${env.SITE_NAME}/edge-handlers?scope=deployid:${env.DEPLOY_ID}`

    utils.status.show({
      title: 'Edge Handlers',
      summary: `${summaryText} [Watch Logs](${logsLink})`,
    })
  }
}
