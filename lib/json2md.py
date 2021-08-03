#!/usr/bin/env python3

import argparse
import json
import os
import sys

class UserException(Exception):
    pass

def to_s(e, nwo, src, ref=None):
    if ref is None:
        ref = "HEAD"

    if type(e) is not dict:
        return str(e) # Convert integers, also catch-all for anything else we haven't seen yet

    url = f"{e['url']['uri']}#L{e['url']['startLine']}"
    if url.startswith(f"file:{src}"):
        url = f"https://github.com/{nwo}/blob/{ref}" + url[len(f"file:{src}"):]
    url = f"[{e['label']}]({url})"

    return url

def to_md(g, tuple, nwo, src=None):
    tuple = [ to_s(e, nwo, src) for e in tuple]
    g.write(f"|{'|'.join(tuple)}|\n")

def main(args):

    with open(args.input, newline='') as f:
        data = json.load(f)


    with open(args.output, 'w') as g:
        g.write("## " + args.nwo + "\n\n")

        to_md(g, [ col.get('name', '-') for col in data['#select']['columns']], args.nwo)

        g.write(f"|{'|'.join(['---' for _ in data['#select']['columns']])}|\n")

        for tuple in data['#select']['tuples']:
            to_md(g, tuple, args.nwo, args.src)

    return 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('input', help='input file')
    parser.add_argument('--src', help='source location prefix')
    parser.add_argument('--nwo', help='repository nwo')
    parser.add_argument('--ref', help='ref analyzed')
    parser.add_argument('-o', '--output', default='output.md', help='output file')
    args = parser.parse_args()

    script_path = os.path.dirname(os.path.realpath(__file__))

    try:
        sys.exit(main(args))
    except UserException as e:
        print(e)
        sys.exit(1)
