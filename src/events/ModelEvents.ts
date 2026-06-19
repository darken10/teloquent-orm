/**
 * Système d'événements de cycle de vie des modèles (observers).
 * Équivalent simplifié des Model Events de Laravel.
 */

export type ModelEvent =
  | "creating"
  | "created"
  | "updating"
  | "updated"
  | "deleting"
  | "deleted";

type Listener = (model: any) => void | Promise<void>;

const listeners = new Map<Function, Map<ModelEvent, Listener[]>>();

/** Abonne un callback à un événement d'une classe de modèle. */
export function on(modelClass: Function, event: ModelEvent, cb: Listener): void {
  if (!listeners.has(modelClass)) listeners.set(modelClass, new Map());
  const byEvent = listeners.get(modelClass)!;
  if (!byEvent.has(event)) byEvent.set(event, []);
  byEvent.get(event)!.push(cb);
}

/** Déclenche un événement pour une instance (appelé en interne par le Model). */
export async function fireModelEvent(model: any, event: ModelEvent): Promise<void> {
  const byEvent = listeners.get(model.constructor);
  const cbs = byEvent?.get(event);
  if (!cbs) return;
  for (const cb of cbs) {
    await cb(model);
  }
}
