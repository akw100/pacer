import { Hono } from 'hono';
import { HabitCreateSchema, HabitUpdateSchema } from '@pacer/shared';
import type { AppEnv } from '../lib/auth';
import { zValidator } from '../lib/validate';
import { emit } from '../lib/events';

export const habits = new Hono<AppEnv>()
  .get('/', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const { data, error } = await db
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('sort', { ascending: true });
    if (error) {
      return c.json({ error: error.message }, 500);
    }
    return c.json(data);
  })
  .post('/', zValidator('json', HabitCreateSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const { data, error } = await db
      .from('habits')
      .insert({
        user_id: userId,
        name: body.name,
        emoji: body.emoji,
        sort: body.sort ?? 0,
      })
      .select('*')
      .single();
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json(data, 201);
  })
  .patch('/:id', zValidator('json', HabitUpdateSchema), async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const updates = c.req.valid('json');
    const { data, error } = await db
      .from('habits')
      .update(updates)
      .eq('id', c.req.param('id'))
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json(data);
  })
  .delete('/:id', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const { error } = await db
      .from('habits')
      .delete()
      .eq('id', c.req.param('id'))
      .eq('user_id', userId);
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return new Response(null, { status: 204 });
  })
  .put('/:id/check', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const habitId = c.req.param('id');
    const checkDate = c.req.query('date');

    if (typeof checkDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(checkDate)) {
      return c.json({ error: 'Missing or invalid date query param' }, 422);
    }

    const habitCheck = await db
      .from('habits')
      .select('id')
      .eq('id', habitId)
      .eq('user_id', userId)
      .single();

    if (habitCheck.error || !habitCheck.data) {
      return c.json({ error: 'Habit not found' }, 404);
    }

    const { data, error } = await db
      .from('habit_checks')
      .insert({
        user_id: userId,
        habit_id: habitId,
        check_date: checkDate,
      })
      .select('*')
      .single();

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    emit('habit.checked', {
      userId,
      habitId,
      checkDate,
      habitCheckId: data.id,
    });

    return c.json(data, 201);
  })
  .delete('/:id/check', async (c) => {
    const db = c.get('userClient');
    const userId = c.get('userId');
    const checkDate = c.req.query('date');
    if (typeof checkDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(checkDate)) {
      return c.json({ error: 'Missing or invalid date query param' }, 422);
    }
    const { error } = await db
      .from('habit_checks')
      .delete()
      .eq('user_id', userId)
      .eq('habit_id', c.req.param('id'))
      .eq('check_date', checkDate);
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return new Response(null, { status: 204 });
  });
