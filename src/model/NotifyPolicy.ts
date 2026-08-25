import type { Contact } from './Contact.js';

/**
 * Decides which contacts get called for a given trip.
 *
 * The design doc calls everyone. The listed improvement -- a per-contact time
 * field that picks the contact on duty -- drops in here as another policy,
 * without the controller changing.
 */
export interface NotifyPolicy {
  select(contacts: readonly Contact[], at: Date): readonly Contact[];
}

export const callEveryone: NotifyPolicy = {
  select: (contacts) => contacts,
};
