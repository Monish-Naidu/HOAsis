/**
 * Ids for rows the screen wants to name before the write has landed.
 *
 * A screen invents an id for anything it creates, so it can show the thing
 * at once. For a real association that id is passed to the database as
 * given, which means it has to be a uuid; and a row is told apart from a
 * demo record by whether its id is one.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID.test(id);
}

export function newId(): string {
  return crypto.randomUUID();
}
