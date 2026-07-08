import { SelectionStrategy } from './selection.strategy';

export class FirstSelectionStrategy implements SelectionStrategy {
  select(array: any[]): any {
    return array.length > 0 ? array[0] : null;
  }
}
