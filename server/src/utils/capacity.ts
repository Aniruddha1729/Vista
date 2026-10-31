export function eventHasRoomFilter(eventId: string) {
  return {
    _id: eventId,
    status: 'published',
    $expr: { $lt: ['$registeredCount', '$capacity'] },
  }
}
