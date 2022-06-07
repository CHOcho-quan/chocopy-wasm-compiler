import { assertPrint, assertTCFail, assertTC, assertFail } from "./asserts.test";
import { NUM, BOOL, NONE, CLASS } from "./helpers.test"

describe("Break & Continue tests", () => {

// 1 - break out of loop
assertTCFail("break-out-of-loop",
`
if (1 == 1):
  break
`)

// 2 - break in for loop
assertPrint("break-in-loop",
`
a:[int] = None
i:int = 0
a = [2,3,4,5]
for i in a:
  print(i)
  if (i == 4):
    break
`, [`2`, `3`, `4`])

// 3 - break in nested for loop
assertPrint("break-in-nested-loop",
`
a: [[int]] = None
b: [int] = None
i: [int] = None
j: int = 12
b = [2,3,4,5]
a = [b, [1,2], [3, 4]]
while (1 == 1):
  for i in a:
    for j in i:
      if (j == 3):
        break
      print(j)
  break
print(j)
`, [`2`, `1`, `2`, `3`])

// 4 - break in functions
assertPrint("break-in-functions",
`
def foo() -> int:
  a: [[int]] = None
  b: [int] = None
  i: [int] = None
  j: int = 12
  b = [2,3,4,5]
  a = [b, [1,2], [3, 4]]
  for i in a:
    for j in i:
      print(j)
      if (j == 3):
        break
  return j

print(foo())
`, [`2`, `3`, `1`, `2`, `3`, `3`])

// 5 - break and continue in functions
assertPrint("break-and-continue-in-functions",
`
def foo() -> int:
  a: [[int]] = None
  b: [int] = None
  i: [int] = None
  j: int = 12
  b = [2,3,4,5]
  a = [b, [6, 7, 8, 9], [10, 11, 12, 13]]
  for i in a:
    for j in i:
      if (j == 4):
        break
      if (j == 8):
        continue
      print(j)
  return j

print(foo())
`, [`2`, `3`, `6`, `7`, `9`, `10`, `11`, `12`, `13`, `13`])

// 6 - continue out of loop
assertTCFail("continue-out-of-loop",
`
continue
`)

// 7 - continue in for loop
assertPrint("continue-in-loop",
`
a:[int] = None
i:int = 0
a = [2,3,4,5]
for i in a:
  if (i == 4):
    continue
  print(i)
`, [`2`, `3`, `5`])

// 8 - continue in nested for loop
assertPrint("continue-in-nested-loop",
`
a: [[int]] = None
b: [int] = None
i: [int] = None
j: int = 12
b = [2,3,4,5]
a = [b, [1,2], [3, 4]]
while (1 == 1):
  if (j == 12):
    j = 11
    continue
  for i in a:
    for j in i:
      if (j == 3):
        continue
      print(j)
  break
print(j)
`, [`2`, `4`, `5`, `1`, `2`, `4`, `4`])

// 9 - continue in functions
assertPrint("continue-in-functions",
`
def foo() -> int:
  a: [[int]] = None
  b: [int] = None
  i: [int] = None
  j: int = 12
  b = [2,3,4,5]
  a = [b, [1,2], [3, 4]]
  for i in a:
    for j in i:
      if (j == 3):
        continue
      print(j)
  return j

print(foo())
`, [`2`, `4`, `5`, `1`, `2`, `4`, `4`])


});
