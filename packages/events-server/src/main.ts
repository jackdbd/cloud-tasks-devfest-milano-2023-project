import { env } from 'node:process'
import { app } from './app.js'

/**
 * Provisions a Fastify server for the current environment.
 */
export const provision = async () => {
  const { server } = await app()

  try {
    const address = await server.listen({
      host: '0.0.0.0',
      port: parseInt(env.PORT)
    })
    console.log(`Server listening on ${address}`)
  } catch (err: any) {
    server.log.error(err)
    process.exit(1)
  }
}

provision()
