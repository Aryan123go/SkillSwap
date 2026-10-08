import mongoose from 'mongoose'

export async function connectDatabase() {
  const { MONGODB_URI } = process.env
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required to start the server.')
  }

  try {
    await mongoose.connect(MONGODB_URI, { dbName: 'skillswap' })
    console.info('Connected to MongoDB.')
  } catch (error) {
    const code = error.code ?? error.cause?.code ?? 'NO_ERROR_CODE'
    console.error(`MongoDB connection failed (${error.name}; ${code}).`)
    throw error
  }
}
