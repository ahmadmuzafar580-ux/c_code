#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX 100

// Structure
struct Student {
    int id;
    char name[50];
    float marks;
};

// Global array
struct Student s[MAX];
int count = 0;

// Function prototypes
void addStudent();
void displayStudents();
void searchStudent();
void deleteStudent();
void saveToFile();
void loadFromFile();

int main() {
    int choice;

    loadFromFile();

    while (1) {
        printf("\n===== STUDENT MANAGEMENT SYSTEM =====\n");
        printf("1. Add Student\n");
        printf("2. Display Students\n");
        printf("3. Search Student\n");
        printf("4. Delete Student\n");
        printf("5. Save to File\n");
        printf("6. Exit\n");
        printf("Enter your choice: ");
        scanf("%d", &choice);

        switch (choice) {
            case 1: addStudent(); break;
            case 2: displayStudents(); break;
            case 3: searchStudent(); break;
            case 4: deleteStudent(); break;
            case 5: saveToFile(); break;
            case 6: 
                saveToFile();
                printf("Exiting...\n");
                exit(0);
            default:
                printf("Invalid choice!\n");
        }
    }

    return 0;
}

// Add Student
void addStudent() {
    if (count >= MAX) {
        printf("Database full!\n");
        return;
    }

    printf("Enter ID: ");
    scanf("%d", &s[count].id);

    printf("Enter Name: ");
    scanf(" %[^\n]", s[count].name);

    printf("Enter Marks: ");
    scanf("%f", &s[count].marks);

    count++;
    printf("Student added successfully!\n");
}

// Display Students
void displayStudents() {
    if (count == 0) {
        printf("No records found!\n");
        return;
    }

    printf("\nID\tName\t\tMarks\n");
    printf("-----------------------------------\n");

    for (int i = 0; i < count; i++) {
        printf("%d\t%s\t\t%.2f\n", s[i].id, s[i].name, s[i].marks);
    }
}

// Search Student
void searchStudent() {
    int id, found = 0;

    printf("Enter ID to search: ");
    scanf("%d", &id);

    for (int i = 0; i < count; i++) {
        if (s[i].id == id) {
            printf("Student Found:\n");
            printf("ID: %d\nName: %s\nMarks: %.2f\n", s[i].id, s[i].name, s[i].marks);
            found = 1;
            break;
        }
    }

    if (!found) {
        printf("Student not found!\n");
    }
}

// Delete Student
void deleteStudent() {
    int id, found = 0;

    printf("Enter ID to delete: ");
    scanf("%d", &id);

    for (int i = 0; i < count; i++) {
        if (s[i].id == id) {
            for (int j = i; j < count - 1; j++) {
                s[j] = s[j + 1];
            }
            count--;
            printf("Student deleted successfully!\n");
            found = 1;
            break;
        }
    }

    if (!found) {
        printf("Student not found!\n");
    }
}

// Save to File
void saveToFile() {
    FILE *fp = fopen("students.txt", "w");

    if (fp == NULL) {
        printf("Error opening file!\n");
        return;
    }

    for (int i = 0; i < count; i++) {
        fprintf(fp, "%d %s %f\n", s[i].id, s[i].name, s[i].marks);
    }

    fclose(fp);
    printf("Data saved to file!\n");
}

// Load from File
void loadFromFile() {
    FILE *fp = fopen("students.txt", "r");

    if (fp == NULL) return;

    while (fscanf(fp, "%d %s %f", &s[count].id, s[count].name, &s[count].marks) != EOF) {
        count++;
    }

    fclose(fp);
}