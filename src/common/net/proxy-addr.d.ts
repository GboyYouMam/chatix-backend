declare module 'proxy-addr' {
  function proxyAddr(
    request: {
      headers: Record<string, string | string[] | undefined>;
      socket: { remoteAddress?: string };
    },
    trust: (address: string, hop: number) => boolean,
  ): string;

  namespace proxyAddr {
    function compile(
      subnets: string[],
    ): (address: string, hop: number) => boolean;
  }

  export = proxyAddr;
}
