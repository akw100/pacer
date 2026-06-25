import { Hono } from 'hono'
import type { AppEnv } from '../lib/auth'
import { RunCreateSchema } from '@pacer/shared'
import { zValidator } from '../lib/validate'

export const runs = new Hono<AppEnv>()
  .post('/', zValidator('json', RunCreateSchema), async (c) => {
    const db = c.get('userClient')
    const userId = c.get('userId')
    const payload = c.req.valid('json')

    const { data, error } = await db
      .from('runs')
      .insert({
        user_id: userId,
        run_date: payload.run_date,
        distance_meters: payload.distance_meters,
        duration_seconds: payload.duration_seconds,
      })
      .select('*')
      .single()

    if (error) {
      return c.json({ error: error.message }, 400)
    }

    return c.json(data)
  })
