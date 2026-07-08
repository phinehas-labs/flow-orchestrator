import { TransformerStrategy } from './transformer.strategy';

export class StringTransformer implements TransformerStrategy {
  transform(value: any): string {
    return value !== undefined && value !== null ? String(value) : '';
  }
}

export class NumberTransformer implements TransformerStrategy {
  transform(value: any): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }
}

export class BooleanTransformer implements TransformerStrategy {
  transform(value: any): boolean {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return !!value;
  }
}

export class DateTransformer implements TransformerStrategy {
  transform(value: any): string {
    if (!value) return new Date().toISOString();
    return new Date(value).toISOString();
  }
}

export class BearerTransformer implements TransformerStrategy {
  transform(value: any): string {
    return value ? `Bearer ${value}` : '';
  }
}
