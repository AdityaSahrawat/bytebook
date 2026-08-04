import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export const errorHandler = (
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
) => {
  console.error('❌ Fastify Error Handler:', error);
  const statusCode = error.statusCode || 400;
  reply.status(statusCode).send({
    success: false,
    error: error.message || 'Internal Server Error',
  });
};
