import { UrlNode } from './UrlNode';

const TEST_DYNAMIC_ROUTE = /\/\[[^/]+?\](?=\/|$)/;
const reHasRegExp = /[|\\{}()[\]^$+*?.-]/;
const reReplaceRegExp = /[|\\{}()[\]^$+*?.-]/g;

export function isDynamicRoute(route: string) {
  return TEST_DYNAMIC_ROUTE.test(route);
}

/**
 * Parses a given parameter from a route to a data structure that can be used
 * to generate the parametrized route. Examples:
 *   - `[...slug]` -> `{ name: 'slug', repeat: true, optional: true }`
 *   - `[foo]` -> `{ name: 'foo', repeat: false, optional: true }`
 *   - `bar` -> `{ name: 'bar', repeat: false, optional: false }`
 */
function parseParameter(param: string) {
  const optional = param.startsWith('[') && param.endsWith(']');
  if (optional) {
    param = param.slice(1, -1);
  }
  const repeat = param.startsWith('...');
  if (repeat) {
    param = param.slice(3);
  }
  return { key: param, repeat, optional };
}

function getParametrizedRoute(route: string) {
  // const segments = removeTrailingSlash(route).slice(1).split('/')
  const segments = route.slice(1).split('/');
  const groups = {} as Record<string, unknown>;
  let groupIndex = 1;
  return {
    parameterizedRoute: segments
      .map((segment) => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
          const { key, optional, repeat } = parseParameter(
            segment.slice(1, -1)
          );
          groups[key] = { pos: groupIndex++, repeat, optional };
          return repeat ? (optional ? '(?:/(.+?))?' : '/(.+?)') : '/([^/]+?)';
        } else {
          return `/${escapeStringRegexp(segment)}`;
        }
      })
      .join(''),
    groups,
  };
}

export function getRouteRegex(normalizedRoute: string) {
  const { parameterizedRoute, groups } = getParametrizedRoute(normalizedRoute);
  return {
    re: new RegExp(`^${parameterizedRoute}(?:/)?$`),
    groups: groups,
  };
}

function escapeStringRegexp(str: string) {
  // see also: https://github.com/lodash/lodash/blob/2da024c3b4f9947a48517639de7560457cd4ec6c/escapeRegExp.js#L23
  if (reHasRegExp.test(str)) {
    return str.replace(reReplaceRegExp, '\\$&');
  }
  return str;
}

/**
 * Convert browser pathname to NextJs route.
 * This method is required for proper work of Dynamic routes  in NextJS.
 */
export function pathnameToRoute(
  cleanPathname: string,
  routes: string[]
): string | undefined {
  if (routes.includes(cleanPathname)) {
    return cleanPathname;
  }

  for (const route of routes) {
    if (isDynamicRoute(route) && getRouteRegex(route).re.test(cleanPathname)) {
      return route;
    }
  }

  return undefined;
}

/**
 * Sort provided pages in correct nextjs order.
 * This sorting is required if you are using dynamic routes in your apps.
 * If order is incorrect then Nextjs may use dynamicRoute instead of exact page.
 */
export function sortNextPages(pages: string[]): string[] {
  const root = new UrlNode();
  pages.forEach((pageRoute) => root.insert(pageRoute));
  // Smoosh will then sort those sublevels up to the point where you get the correct route definition priority
  return root.smoosh();
}
