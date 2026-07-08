import { SelectionStrategy } from './selection.strategy';

export class LastSelectionStrategy implements SelectionStrategy {
  select(array: any[]): any {
    return array.length > 0 ? array[array.length - 1] : null;
  }
}
