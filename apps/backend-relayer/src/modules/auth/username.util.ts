import {
  adjectives,
  names,
  uniqueNamesGenerator,
} from 'unique-names-generator';

export function generateUniqueName(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, names],
    separator: '-',
    length: 2,
    style: 'lowerCase',
  });
}
