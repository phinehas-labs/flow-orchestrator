import { SelectionStrategy } from './selection.strategy';

export class AllSelectionStrategy implements SelectionStrategy {
  select(array: any[]): any {
    return array;
  }
}
