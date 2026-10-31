import { Registration } from '../models/registration.model.js'

export async function prepareRegistrationIndexes() {
  await Registration.createCollection().catch((error: { codeName?: string }) => {
    if (error.codeName !== 'NamespaceExists') throw error
  })

  const indexes = await Registration.collection.indexes()
  const oldRegistrationIndex = indexes.find((index) =>
    index.unique
    && !index.partialFilterExpression
    && index.key.user === 1
    && index.key.event === 1,
  )
  if (oldRegistrationIndex) await Registration.collection.dropIndex(oldRegistrationIndex.name)

  await Registration.createIndexes()
}
