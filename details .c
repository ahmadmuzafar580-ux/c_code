#include <stdio.h>
int main() {
    char name[50];
    int age;

    printf("Enter your name: ");
    fgets(name, sizeof(name), stdin); // Read a line of input

    printf("Enter your age: ");
    scanf("%d", &age); // Read an integer input

    printf("Hello, %sYou are %d years old.\n", name, age);

    return 0;
}