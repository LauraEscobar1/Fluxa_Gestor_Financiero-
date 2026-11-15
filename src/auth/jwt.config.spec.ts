import { ConfigService } from '@nestjs/config';
import { jwtModuleOptionsFactory } from './jwt.config';

describe('jwtModuleOptionsFactory', () => {
  const config = (env: Record<string, string>) => new ConfigService(env);

  it.each([[{}], [{ JWT_SECRET: '' }], [{ JWT_SECRET: '   ' }]])(
    'falla con un mensaje claro si falta JWT_SECRET (%j)',
    (env) => {
      expect(() => jwtModuleOptionsFactory(config(env))).toThrow(
        /JWT_SECRET no está definido/,
      );
    },
  );

  it('usa JWT_EXPIRES_IN=1h por defecto', () => {
    expect(
      jwtModuleOptionsFactory(config({ JWT_SECRET: 's' })).signOptions,
    ).toEqual({ expiresIn: '1h' });
  });

  it('convierte un número en texto a segundos', () => {
    expect(
      jwtModuleOptionsFactory(
        config({ JWT_SECRET: 's', JWT_EXPIRES_IN: '3600' }),
      ).signOptions,
    ).toEqual({ expiresIn: 3600 });
  });
});
