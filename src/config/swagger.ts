import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Collaborative Workspace API',
            version: '1.0.0',
            description: 'Real-Time Collaborative Workspace Backend API'
        },
        servers: [{ url: 'http://localhost:3000', description: 'Development' }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
            }
        },
    },
    apis: ['./src/routes/*.ts']
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
    app.get('/api-docs.json', (req, res) => res.json(specs));
}
