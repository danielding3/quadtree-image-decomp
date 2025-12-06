export function truncateString(str, maxLength) {
  if (str.length <= maxLength) {
    return str; // No truncation needed
  } else {
    // Subtract 3 from maxLength to account for the ellipsis
    const truncatedStr = str.substring(0, maxLength - 3);
    return truncatedStr + "...";
  }
}