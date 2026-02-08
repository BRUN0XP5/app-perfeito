
import sys

def check_braces(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    for i, char in enumerate(content):
        if char == '{':
            stack.append(i)
        elif char == '}':
            if not stack:
                print(f"Extra closing brace at position {i}")
            else:
                stack.pop()
    
    if stack:
        for pos in stack:
            # find line number
            line = content.count('\n', 0, pos) + 1
            print(f"Unclosed open brace starting at line {line}")

if __name__ == "__main__":
    check_braces(sys.argv[1])
