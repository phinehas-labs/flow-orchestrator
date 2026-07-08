import { SelectionStrategy } from './selection.strategy';

export class RandomSelectionStrategy implements SelectionStrategy {
  select(array: any[]): any {
    if (array.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }
}
